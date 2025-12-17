"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const VisualEditsMessenger = dynamic(
    () => import("orchids-visual-edits").then((mod) => mod.VisualEditsMessenger),
    { ssr: false }
);

export default function VisualEditsMessengerWrapper() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return <VisualEditsMessenger />;
}
