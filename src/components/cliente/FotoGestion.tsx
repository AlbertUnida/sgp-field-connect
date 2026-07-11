import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/**
 * A3: Muestra fotos desde bucket privado generando signed URL temporal (1h).
 * Soporta paths nuevos ("userId/timestamp.jpg") y URLs legacy completas.
 */
export const FotoGestion = ({ url }: { url: string }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      let path = url;
      if (url.startsWith("http")) {
        const match = url.match(/\/gestiones-fotos\/(.+?)(\?|$)/);
        path = match ? decodeURIComponent(match[1]) : url;
      }
      const { data } = await supabase.storage
        .from("gestiones-fotos")
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) setSignedUrl(data.signedUrl);
    };
    resolve();
  }, [url]);

  if (!signedUrl) return (
    <div className="mt-2.5 w-full h-28 rounded-xl bg-muted animate-pulse" />
  );

  return (
    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="mt-2.5 block">
      <img
        src={signedUrl}
        alt="Evidencia de visita"
        className="w-full rounded-xl object-cover border border-border"
        style={{ maxHeight: 200 }}
      />
      <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Camera className="h-3 w-3" /> Ver foto completa
      </span>
    </a>
  );
};
