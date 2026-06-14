import React from 'react';

export default function StarRating({ rating, count }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="card-rating">
      <div className="stars">
        {stars.map(s => {
          const filled = rating >= s;
          const half = !filled && rating >= s - 0.5;
          return (
            <span key={s} className={`star ${filled ? 'filled' : half ? 'half' : ''}`}>★</span>
          );
        })}
      </div>
      {count != null && <span className="review-count">({count})</span>}
    </div>
  );
}
