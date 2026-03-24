'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Lead {
  id: string;
  business_name: string;
  business_type: string;
  postcode: string;
  status: string;
  google_rating: number;
  lat?: number;
  lng?: number;
}

interface Props {
  leads: Lead[];
  onLeadClick: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#60a5fa',      // blue-400
  visited: '#eab308',  // yellow-500
  pitched: '#c084fc',  // purple-400
  sold: '#4ade80',     // green-400
  rejected: '#666',
};

export default function LeafletMap({ leads, onLeadClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Dark tile layer
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    // Dark map tiles (CartoDB dark matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Zoom control on right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Small attribution
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:#666">OSM</a>')
      .addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Add lead markers
    const bounds: L.LatLngExpression[] = [];

    leads.forEach(lead => {
      if (!lead.lat || !lead.lng) return;

      const color = STATUS_COLORS[lead.status] ?? STATUS_COLORS.new;
      const latlng: L.LatLngExpression = [lead.lat, lead.lng];
      bounds.push(latlng);

      const marker = L.circleMarker(latlng, {
        radius: 8,
        fillColor: color,
        fillOpacity: 0.9,
        color: color,
        weight: 2,
        opacity: 0.4,
      }).addTo(map);

      // Tooltip
      marker.bindTooltip(
        `<div style="font-family:Geist,sans-serif;font-size:12px;line-height:1.4;padding:2px 0">
          <strong style="color:#fff">${lead.business_name}</strong><br/>
          <span style="color:#999">${lead.business_type} · ${lead.postcode}</span>
          ${lead.google_rating ? `<br/><span style="color:#999">${lead.google_rating}★</span>` : ''}
        </div>`,
        {
          direction: 'top',
          offset: [0, -10],
          className: 'dark-tooltip',
        }
      );

      marker.on('click', () => onLeadClick(lead.id));
    });

    // Fit bounds
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    } else {
      // Default: Manchester
      map.setView([53.4808, -2.2426], 12);
    }
  }, [leads, onLeadClick]);

  return (
    <>
      <div ref={mapRef} className="w-full h-full" />
      <style jsx global>{`
        .dark-tooltip {
          background: #1a1a1a !important;
          border: 1px solid #333 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
          padding: 8px 12px !important;
        }
        .dark-tooltip::before {
          border-top-color: #333 !important;
        }
        .leaflet-control-zoom a {
          background: #1a1a1a !important;
          color: #999 !important;
          border-color: #333 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #333 !important;
          color: #fff !important;
        }
      `}</style>
    </>
  );
}
