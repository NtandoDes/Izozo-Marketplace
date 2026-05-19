import { useEffect, useState } from "react";
import API from "../api/api";
import { Link } from "react-router-dom";

export default function CartPage() {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    API.get("cart/")  // Your backend endpoint
      .then(res => setCart(res.data))
      .catch(err => console.error(err));
  }, []);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
      {cart.map(item => (
        <div key={item.id} className="bg-white p-4 rounded shadow mb-2 flex justify-between">
          <span>{item.product.name} x {item.quantity}</span>
          <span>R {item.price * item.quantity}</span>
        </div>
      ))}
      <h2 className="text-xl font-bold mt-4">Total: R {total}</h2>
      <Link to="/checkout" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded">
        Checkout
      </Link>
    </div>
  );
}
