"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Globe: any = dynamic(() => import("react-globe.gl") as any, { ssr: false });

const LEADS = [
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Manchester", lat: 53.4808, lng: -2.2426 },
  { name: "Birmingham", lat: 52.4862, lng: -1.8904 },
  { name: "Leeds", lat: 53.8008, lng: -1.5491 },
  { name: "Glasgow", lat: 55.8642, lng: -4.2518 },
  { name: "Bristol", lat: 51.4545, lng: -2.5879 },
  { name: "Liverpool", lat: 53.4084, lng: -2.9916 },
  { name: "Edinburgh", lat: 55.9533, lng: -3.1883 },
  { name: "Sheffield", lat: 53.3811, lng: -1.4701 },
  { name: "Newcastle", lat: 54.9783, lng: -1.6178 },
  { name: "Cardiff", lat: 51.4816, lng: -3.1791 },
  { name: "Dublin", lat: 53.3498, lng: -6.2603 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { name: "Brighton", lat: 50.8225, lng: -0.1372 },
  { name: "Oxford", lat: 51.7520, lng: -1.2577 },
];

interface RingData { lat: number; lng: number; maxR: number; propagationSpeed: number; repeatPeriod: number; }
interface LabelData { lat: number; lng: number; name: string; id: number; }

export function AnimatedSphere() {
  const globeRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [rings, setRings] = useState<RingData[]>([]);
  const [labels, setLabels] = useState<LabelData[]>([]);
  const labelIdRef = useRef(0);
  const leadIndexRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Initial view: face UK
  useEffect(() => {
    if (!mounted || !globeRef.current) return;
    const timer = setTimeout(() => {
      if (globeRef.current) {
        // Start zoomed out, facing UK
        globeRef.current.pointOfView({ lat: 52, lng: -1, altitude: 2.2 }, 0);
        // Disable all user controls
        const controls = globeRef.current.controls();
        if (controls) {
          controls.enableRotate = false;
          controls.enableZoom = false;
          controls.enablePan = false;
          controls.autoRotate = false;
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [mounted]);

  // Cycle through leads — globe spins to each one
  useEffect(() => {
    if (!mounted) return;

    const spawnLead = () => {
      const lead = LEADS[leadIndexRef.current % LEADS.length];
      leadIndexRef.current++;
      const id = labelIdRef.current++;

      // Fly globe to this lead's location
      if (globeRef.current) {
        globeRef.current.pointOfView(
          { lat: lead.lat, lng: lead.lng, altitude: 2.0 },
          1500 // 1.5s smooth transition
        );
      }

      // Add ring at exact location
      setRings(prev => [...prev.slice(-4), {
        lat: lead.lat,
        lng: lead.lng,
        maxR: 4,
        propagationSpeed: 3,
        repeatPeriod: 1000,
      }]);

      // Add label at exact location
      setLabels(prev => [...prev.slice(-1), {
        lat: lead.lat,
        lng: lead.lng,
        name: lead.name,
        id,
      }]);

      // Remove label after delay
      setTimeout(() => {
        setLabels(prev => prev.filter(l => l.id !== id));
      }, 4000);

      // Remove ring after delay
      setTimeout(() => {
        setRings(prev => prev.slice(1));
      }, 4500);
    };

    // First lead after 2s, then every 5s
    const t = setTimeout(spawnLead, 2000);
    const i = setInterval(spawnLead, 5000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [mounted]);

  if (!mounted) return <div style={{ width: 560, height: 560 }} />;

  return (
    <div style={{ width: 560, height: 560 }}>
      <Globe
        ref={globeRef}
        width={560}
        height={560}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        showAtmosphere={true}
        atmosphereColor="rgba(200, 190, 180, 0.25)"
        atmosphereAltitude={0.12}

        // Static markers for all lead cities
        pointsData={LEADS}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#e8723a"}
        pointAltitude={0.01}
        pointRadius={0.4}

        // Animated rings on new leads
        ringsData={rings}
        ringLat={(d: any) => d.lat}
        ringLng={(d: any) => d.lng}
        ringColor={() => (t: number) => `rgba(232, 114, 58, ${1 - t})`}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"

        // Labels for active leads
        labelsData={labels}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => `New lead · ${d.name}`}
        labelSize={1.5}
        labelDotRadius={0.4}
        labelDotOrientation={() => "bottom" as const}
        labelColor={() => "#1a1a18"}
        labelResolution={2}
        labelAltitude={0.025}
      />
    </div>
  );
}
