'use client';

export default function StoreError({ reset }: { reset: () => void }) {
  return (
    <div className="pg" role="alert">
      <div className="al e"><b>We couldn't load the Store Manager</b>Your existing orders remain safe.</div>
      <button className="p" onClick={reset}>Try again</button>
    </div>
  );
}
