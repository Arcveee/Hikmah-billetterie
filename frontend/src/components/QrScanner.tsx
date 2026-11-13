import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, CameraSlash, CircleNotch } from "@phosphor-icons/react";

interface Props {
  onResult: (text: string) => void;
  active: boolean;
}

export default function QrScanner({ onResult, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }

    setStarting(true);
    setError(null);

    const reader = new BrowserQRCodeReader();
    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err, controls) => {
        controlsRef.current = controls;
        setStarting(false);
        if (result) {
          onResult(result.getText());
        }
        if (err && !(err.message?.includes("No MultiFormat"))) {
          // Ignorer les erreurs de frame vide (normales entre scans)
        }
      })
      .catch((e: unknown) => {
        setStarting(false);
        const msg = (e as Error).message ?? "";
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          setError("Accès à la caméra refusé. Autorisez la caméra dans les paramètres du navigateur.");
        } else {
          setError("Impossible d'accéder à la caméra.");
        }
      });

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, onResult]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-[12.5px] text-destructive">
        <CameraSlash size={24} weight="fill" />
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      {starting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <CircleNotch size={28} className="animate-spin text-white" />
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full"
        style={{ maxHeight: 280, objectFit: "cover" }}
        muted
        playsInline
      />
      {/* Viseur */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-40 rounded-xl border-2 border-or opacity-80" />
      </div>
      <p className="absolute bottom-2 w-full text-center text-[11px] font-semibold text-white/70">
        <Camera size={12} className="mr-1 inline" /> Pointez vers le QR code du billet
      </p>
    </div>
  );
}
