import { Link } from "react-router-dom";

export default function BusinessSelectionPage() {
  return (
    <section>
      <h1>Choose Business</h1>
      <div className="business-grid">
        <Link className="card business-card tailor" to="/business/tailor">
          <h2>Tailor Shop</h2>
          <p>Slab-based incentive engine</p>
        </Link>
        <Link className="card business-card butcher" to="/business/butcher">
          <h2>Butcher Shop</h2>
          <p>Hours to cuts multiplier engine</p>
        </Link>
      </div>
    </section>
  );
}
