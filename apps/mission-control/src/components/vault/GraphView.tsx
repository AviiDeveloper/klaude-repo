'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { useVaultStore } from '@/lib/vault-store';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { drag } from 'd3-drag';
import { zoom, zoomIdentity } from 'd3-zoom';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  collection: string;
  tags: string[];
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
}

const COLLECTION_COLORS: Record<string, string> = {
  knowledge: '#39d353',
  vault: '#a371f7',
  changelog: '#3fb950',
  adr: '#d29922',
};

export function GraphView() {
  const { graphVisible, toggleGraph, openFile } = useVaultStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!graphVisible) return;
    setLoading(true);
    fetch('/api/vault/graph')
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [graphVisible]);

  useEffect(() => {
    if (!svgRef.current || loading || nodes.length === 0) return;

    const svgEl = svgRef.current;
    const svg = select(svgEl);
    svg.selectAll('*').remove();

    const width = svgEl.clientWidth;
    const height = svgEl.clientHeight;

    const g = svg.append('g');

    // Zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    svg.call(zoomBehavior.transform, zoomIdentity);

    // Build simulation
    const nodesCopy = nodes.map((n) => ({ ...n }));
    const edgesCopy = edges.map((e) => ({ ...e }));

    const simulation = forceSimulation(nodesCopy)
      .force(
        'link',
        forceLink<GraphNode, GraphEdge>(edgesCopy)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', forceManyBody().strength(-150))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide(25));

    // Draw edges
    const link = g
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(edgesCopy)
      .enter()
      .append('line')
      .attr('stroke', '#30363d')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const node = g
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodesCopy)
      .enter()
      .append('circle')
      .attr('r', 6)
      .attr('fill', (d) => COLLECTION_COLORS[d.collection] || '#58a6ff')
      .attr('stroke', '#0d1117')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const [col, ...pathParts] = d.id.split(':');
        void openFile(col, pathParts.join(':'));
        toggleGraph();
      });

    // Node labels
    const label = g
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodesCopy)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', '9px')
      .attr('fill', '#8b949e')
      .attr('dx', 10)
      .attr('dy', 3)
      .style('pointer-events', 'none');

    // Tooltip on hover
    node.append('title').text((d) => `${d.collection}/${d.label}`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      node.attr('cx', (d) => d.x || 0).attr('cy', (d) => d.y || 0);
      label.attr('x', (d) => d.x || 0).attr('y', (d) => d.y || 0);
    });

    // Drag behavior
    const dragBehavior = drag<SVGCircleElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(dragBehavior);

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, loading, openFile, toggleGraph]);

  if (!graphVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-mc-bg/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mc-border">
        <div className="flex items-center gap-3">
          <Maximize2 className="w-4 h-4 text-mc-accent" />
          <span className="text-sm font-semibold text-mc-text">Knowledge Graph</span>
          <span className="text-xs text-mc-text-secondary">
            {nodes.length} nodes, {edges.length} edges
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3">
            {Object.entries(COLLECTION_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-mc-text-secondary capitalize">{name}</span>
              </div>
            ))}
          </div>
          <button
            onClick={toggleGraph}
            className="p-1.5 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary hover:text-mc-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-mc-text-secondary text-sm animate-pulse">Building graph...</div>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
