import { useEffect, useState } from "react";
import API from "../api/api";

export default function AgentDashboard() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    API.get("orders/agent/")  // endpoint for agent
      .then(res => setOrders(res.data))
      .catch(err => console.error(err));
  }, []);

  const updateStatus = (id, status) => {
    API.patch(`orders/${id}/`, { status })
      .then(() => setOrders(orders.map(o => o.id === id ? {...o, status} : o)))
      .catch(err => console.error(err));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Agent Dashboard</h1>
      {orders.map(order => (
        <div key={order.id} className="bg-white p-4 rounded shadow mb-2 flex justify-between items-center">
          <div>
            <p>Order #{order.id} - {order.status}</p>
            <p>Total: R {order.total_amount}</p>
          </div>
          <div>
            <button onClick={() => updateStatus(order.id, "PROCESSING")} className="bg-yellow-400 text-white px-2 py-1 rounded mr-2">Processing</button>
            <button onClick={() => updateStatus(order.id, "DELIVERED")} className="bg-green-500 text-white px-2 py-1 rounded">Delivered</button>
          </div>
        </div>
      ))}
    </div>
  );
}
import { Link } from "react-router-dom";

export default function AgentDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Agent Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/agent/orders" className="bg-blue-500 text-white p-6 rounded shadow hover:bg-blue-600">
          Manage Orders
        </Link>
        <Link to="/agent/products" className="bg-green-500 text-white p-6 rounded shadow hover:bg-green-600">
          Manage Products
        </Link>
        <Link to="/agent/place-order" className="bg-purple-500 text-white p-6 rounded shadow hover:bg-purple-600">
          Place Order for Customer
        </Link>
      </div>
    </div>
  );
}
