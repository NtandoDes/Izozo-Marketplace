/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/api";
import styles from "./Products.module.css";

const CATEGORIES = ["All", "Clothes", "Food", "Electronics", "Other"];

export default function Products() {
  const [params, setParams] = useSearchParams();

  const initialSearch = params.get("search") || "";
  const initialCategory = params.get("category") || "All";

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(params.get("sort") || "newest");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Keep state in sync when user lands from Home with query params
  useEffect(() => {
    setSearch(initialSearch);
    setCategory(initialCategory);
    setSort(params.get("sort") || "newest");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const fetchProducts = async () => {
    setLoading(true);
    setErr("");

    try {
      // Adjust endpoint to your backend (example: /products/)
      const res = await api.get("/products/", {
        params: {
          search: search || undefined,
          category: category !== "All" ? category : undefined,
          ordering:
            sort === "newest"
              ? "-created_at"
              : sort === "price_asc"
              ? "final_price"
              : sort === "price_desc"
              ? "-final_price"
              : undefined,
        },
      });

      // Expecting DRF list: either res.data (array) or paginated {results:[]}
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setItems(data);
    } catch (e) {
      setErr("Could not load products. Check API endpoint and backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFiltersToUrl = (next = {}) => {
    const nextParams = new URLSearchParams(params);

    if ("search" in next) {
      if (next.search) nextParams.set("search", next.search);
      else nextParams.delete("search");
    }
    if ("category" in next) {
      if (next.category && next.category !== "All") nextParams.set("category", next.category);
      else nextParams.delete("category");
    }
    if ("sort" in next) {
      if (next.sort && next.sort !== "newest") nextParams.set("sort", next.sort);
      else nextParams.delete("sort");
    }

    setParams(nextParams);
  };

  const onCategory = (c) => {
    setCategory(c);
    applyFiltersToUrl({ category: c });
    // fetch with new filters
    setTimeout(fetchProducts, 0);
  };

  const onSort = (value) => {
    setSort(value);
    applyFiltersToUrl({ sort: value });
    setTimeout(fetchProducts, 0);
  };

  const onSearch = () => {
    applyFiltersToUrl({ search });
    fetchProducts();
  };

  const titleHint = useMemo(() => {
    if (category !== "All" && search) return `${category} · “${search}”`;
    if (category !== "All") return category;
    if (search) return `Results for “${search}”`;
    return "All Products";
  }, [category, search]);

  return (
    <div>
      {/* Top strip */}
      <section className={styles.topStrip}>
        <div className="container">
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.h1}>{titleHint}</h1>
              <div className={styles.sub}>
                Browse SME products. Add to cart and checkout securely.
              </div>
            </div>

            <div className={styles.rightTools}>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder="Search products..."
                style={{ width: 260 }}
              />
              <button className="btn btn-brown" onClick={onSearch}>
                Search
              </button>
            </div>
          </div>

          <div className={styles.toolsRow}>
            <div className={styles.pills}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`${styles.pill} ${category === c ? styles.pillActive : ""}`}
                  onClick={() => onCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className={styles.rightTools}>
              <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>
                Sort:
              </span>
              <select
                className={styles.select}
                value={sort}
                onChange={(e) => onSort(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section className="container">
        {loading && <div className={styles.center}>Loading products…</div>}
        {err && <div className={styles.center}>{err}</div>}

        {!loading && !err && items.length === 0 && (
          <div className={styles.center}>No products found.</div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className={styles.grid}>
            {items.map((p) => (
              <div key={p.id} className={styles.card}>
                <div className={styles.img}>
                  {p.images?.[0]?.image ? (
                    <img
                      src={p.images[0].image}
                      alt={p.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    "Image"
                  )}
                </div>

                <div className={styles.body}>
                  <p className={styles.name}>{p.name}</p>
                  <div className={styles.seller}>
                    SME: {p.sme_name || p.sme?.business_name || "—"}
                  </div>

                  <div className={styles.priceRow}>
                    <div className={styles.price}>
                      R{Number(p.final_price ?? p.price ?? 0).toFixed(2)}
                    </div>

                    <button
                      className={styles.addBtn}
                      onClick={() => alert("Next: Add to cart API")}
                    >
                      Add
                    </button>
                  </div>

                  {p.is_available ?? p.active ? (
                    <span className={styles.badgeOk}>Available</span>
                  ) : (
                    <span className={styles.badgeNo}>Not available</span>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <Link
                      to={`/product/${p.id}`}
                      style={{ fontWeight: 900, color: "var(--brown)" }}
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
