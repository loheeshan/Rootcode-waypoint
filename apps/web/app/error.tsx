'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <section role="alert"><h1>Something went wrong</h1><p>Try loading the workspace again.</p><button onClick={reset}>Try again</button></section>; }
