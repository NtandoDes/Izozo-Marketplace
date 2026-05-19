/* eslint-disable no-unused-vars */
import { useState } from "react";
import API from "../api/api";


export default function CheckoutPage() {
  const [form, setForm] = useState({ full_name: "", phone_number: "", address_line_1: "", city: "", province: "" });

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value });

  const handleSubmit = e => {
    e.preventDefault();
    API.post("checkout/", form)
      .then(res => alert("Order placed successfully!"))
      .catch(err => console.error(err));
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input type="text" name="full_name" placeholder="Full Name" className="w-full border p-2 rounded" onChange={handleChange} />
        <input type="text" name="phone_number" placeholder="Phone Number" className="w-full border p-2 rounded" onChange={handleChange} />
        <input type="text" name="address_line_1" placeholder="Address" className="w-full border p-2 rounded" onChange={handleChange} />
        <input type="text" name="city" placeholder="City" className="w-full border p-2 rounded" onChange={handleChange} />
        <input type="text" name="province" placeholder="Province" className="w-full border p-2 rounded" onChange={handleChange} />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded mt-2">Place Order</button>
      </form>
    </div>
  );
}
