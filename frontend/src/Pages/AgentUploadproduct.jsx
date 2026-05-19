import { useState } from "react";
import { createProduct, uploadProductImage } from "../../api/agent";

export default function AgentUploadProduct() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    sme: "",              // SME profile id (if your backend expects it)
    name: "",
    description: "",
    base_price: "",
    agent_fee: "",
    stock_quantity: 0,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    weight_kg: "1.0",
    active: true,
  });

  const [files, setFiles] = useState([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      // 1) Create product (JSON)
      const product = await createProduct({
        ...form,
        // Ensure numbers are numbers if backend expects:
        base_price: String(form.base_price),
        agent_fee: String(form.agent_fee),
        stock_quantity: Number(form.stock_quantity),
        length_cm: Number(form.length_cm),
        width_cm: Number(form.width_cm),
        height_cm: Number(form.height_cm),
        weight_kg: String(form.weight_kg),
      });

      // 2) Upload images (multipart)
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          await uploadProductImage({
            productId: product.id,
            file: files[i],
            is_primary: i === primaryIndex,
          });
        }
      }

      setMsg("✅ Product created successfully!");
    } catch (e) {
      console.error(e);
      setErr("❌ Failed to create product. Check payload fields + API routes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-izozo-brown mb-4">Upload Product</h2>

      <div className="bg-white border border-izozo-border rounded-xl p-6 max-w-2xl">
        {msg && <div className="mb-4 p-3 rounded bg-green-50 text-green-700">{msg}</div>}
        {err && <div className="mb-4 p-3 rounded bg-red-50 text-red-700">{err}</div>}

        <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-4">
          <Field label="SME ID (if required)">
            <input name="sme" value={form.sme} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>

          <Field label="Stock Quantity">
            <input name="stock_quantity" type="number" value={form.stock_quantity} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>

          <Field label="Product name" full>
            <input name="name" value={form.name} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>

          <Field label="Description" full>
            <textarea name="description" value={form.description} onChange={onChange} className="w-full border rounded-lg px-4 py-3 min-h-[110px]" />
          </Field>

          <Field label="Base price (R)">
            <input name="base_price" value={form.base_price} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>

          <Field label="Agent fee (R)">
            <input name="agent_fee" value={form.agent_fee} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>

          <div className="md:col-span-2 mt-2">
            <h3 className="font-semibold text-izozo-brown mb-2">Delivery sizing (PAXI)</h3>
          </div>

          <Field label="Length (cm)">
            <input name="length_cm" type="number" value={form.length_cm} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>
          <Field label="Width (cm)">
            <input name="width_cm" type="number" value={form.width_cm} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>
          <Field label="Height (cm)">
            <input name="height_cm" type="number" value={form.height_cm} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>
          <Field label="Weight (kg)">
            <input name="weight_kg" value={form.weight_kg} onChange={onChange} className="w-full border rounded-lg px-4 py-3" />
          </Field>

          <div className="md:col-span-2 flex items-center gap-2">
            <input type="checkbox" name="active" checked={form.active} onChange={onChange} />
            <span className="text-sm">Active</span>
          </div>

          <div className="md:col-span-2 mt-2">
            <h3 className="font-semibold text-izozo-brown mb-2">Images</h3>

            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="w-full"
            />

            {files.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">Select primary image:</p>
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPrimaryIndex(i)}
                      className={`px-3 py-2 rounded-lg border text-sm ${
                        primaryIndex === i
                          ? "bg-izozo-yellow border-izozo-yellow text-black"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 mt-4">
            <button
              disabled={busy}
              className="w-full bg-izozo-yellow text-black py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving..." : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, full = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-sm text-gray-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
