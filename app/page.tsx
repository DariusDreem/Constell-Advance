import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";
import { loadConstellation } from "@/lib/data";

export default function HomePage() {
  return (
    <Suspense fallback={<SkyLoading />}>
      <Sky />
    </Suspense>
  );
}

/** Reads the session, so it streams in behind the Suspense boundary. */
async function Sky() {
  const data = await loadConstellation();
  // The key remounts the workspace when the user signs in or out.
  return <Workspace key={data.user?.id ?? "demo"} {...data} />;
}

function SkyLoading() {
  return (
    <div className="grid h-dvh place-items-center">
      <p className="font-display text-sm tracking-[0.3em] text-white/40 uppercase">
        Le ciel se lève…
      </p>
    </div>
  );
}
