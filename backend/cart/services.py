from decimal import Decimal


class CartEngine:

    SHIPPING_RATES = {
        "SMALL": Decimal("49.00"),
        "MEDIUM": Decimal("89.00"),
        "LARGE": Decimal("129.00"),
        "XL": Decimal("199.00"),
    }

    def __init__(self, cart):
        self.cart = cart
        self.items = cart.items.select_related("product")

    # =========================
    # SME ENFORCEMENT
    # =========================
    def validate_single_sme(self):
        sme_ids = set(item.product.sme_id for item in self.items)
        return len(sme_ids) <= 1

    # =========================
    # PACKAGING ENGINE
    # =========================
    def compute_package(self):

        total_weight = 0
        total_volume = 0

        for item in self.items:
            product = item.product

            # 🔥 HARD OVERRIDE
            if product.packaging_override != "none":
                return product.packaging_override.upper()

            # 🔥 FOLDABLE COMPRESSION
            if product.is_foldable:
                total_volume += 500 * item.quantity
            else:
                total_volume += product.volume_cm3 * item.quantity

            total_weight += float(product.weight_kg) * item.quantity

        # 🔥 CLASSIFICATION
        if total_volume <= 3000 and total_weight <= 5:
            return "SMALL"
        elif total_volume <= 8000 and total_weight <= 10:
            return "MEDIUM"
        elif total_volume <= 15000:
            return "LARGE"

        return "XL"

    # =========================
    # TOTALS
    # =========================
    def compute_totals(self):

        if not self.items.exists():
            return {
                "subtotal": 0,
                "shipping_tier": None,
                "shipping_cost": 0,
                "total": 0,
            }

        if not self.validate_single_sme():
            return {
                "error": "Cart contains items from multiple SMEs"
            }

        subtotal = sum(item.subtotal for item in self.items)

        shipping_tier = self.compute_package()
        shipping_cost = self.SHIPPING_RATES.get(shipping_tier, Decimal("199.00"))

        return {
            "subtotal": subtotal,
            "shipping_tier": shipping_tier,
            "shipping_cost": shipping_cost,
            "total": subtotal + shipping_cost
        }