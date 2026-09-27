import { Injectable } from '@nestjs/common';

export type MetricLabels = Record<string, string | number | boolean>;

interface MetricSeries {
  name: string;
  labels: Record<string, string>;
  value: number;
}

interface HistogramSeries {
  name: string;
  labels: Record<string, string>;
  sum: number;
  count: number;
}

/**
 * Small Prometheus-compatible metrics registry for the API process.
 *
 * Callers must use bounded, non-sensitive label values (for example a provider
 * name or result type). User IDs, request IDs and URLs must never be labels.
 * A production deployment can scrape /api/v1/metrics or replace this adapter
 * with an OpenTelemetry/Prometheus implementation without changing domains.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, MetricSeries>();
  private readonly gauges = new Map<string, MetricSeries>();
  private readonly histograms = new Map<string, HistogramSeries>();

  increment(name: string, labels: MetricLabels = {}, value = 1): void {
    const series = this.getSeries(this.counters, name, labels);
    series.value += value;
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const series = this.getSeries(this.gauges, name, labels);
    series.value = value;
  }

  observe(name: string, value: number, labels: MetricLabels = {}): void {
    if (!Number.isFinite(value)) return;
    const normalized = this.normalizeLabels(labels);
    const key = this.seriesKey(name, normalized);
    const existing = this.histograms.get(key);
    if (existing) {
      existing.sum += value;
      existing.count += 1;
      return;
    }
    this.histograms.set(key, {
      name: this.metricName(name),
      labels: normalized,
      sum: value,
      count: 1,
    });
  }

  prometheusText(): string {
    const lines: string[] = [];
    this.writeSeries(lines, '# TYPE', this.counters, 'counter');
    this.writeSeries(lines, '# TYPE', this.gauges, 'gauge');
    for (const histogram of this.histograms.values()) {
      lines.push(`# TYPE ${histogram.name} histogram`);
      lines.push(
        `${histogram.name}_count${this.formatLabels(histogram.labels)} ${histogram.count}`,
      );
      lines.push(`${histogram.name}_sum${this.formatLabels(histogram.labels)} ${histogram.sum}`);
    }
    return `${lines.join('\n')}\n`;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private writeSeries(
    output: string[],
    typePrefix: '# TYPE',
    seriesMap: Map<string, MetricSeries>,
    type: 'counter' | 'gauge',
  ): void {
    const names = [...new Set([...seriesMap.values()].map((series) => series.name))];
    for (const name of names) output.push(`${typePrefix} ${name} ${type}`);
    for (const series of seriesMap.values()) {
      output.push(`${series.name}${this.formatLabels(series.labels)} ${series.value}`);
    }
  }

  private getSeries(
    map: Map<string, MetricSeries>,
    name: string,
    labels: MetricLabels,
  ): MetricSeries {
    const normalizedName = this.metricName(name);
    const normalizedLabels = this.normalizeLabels(labels);
    const key = this.seriesKey(normalizedName, normalizedLabels);
    const existing = map.get(key);
    if (existing) return existing;
    const series: MetricSeries = { name: normalizedName, labels: normalizedLabels, value: 0 };
    map.set(key, series);
    return series;
  }

  private metricName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_:]/g, '_').slice(0, 128) || 'unnamed_metric';
  }

  private normalizeLabels(labels: MetricLabels): Record<string, string> {
    return Object.fromEntries(
      Object.entries(labels)
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, 8)
        .map(([key, value]) => [
          key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
          String(value)
            .replace(/[\r\n"\\]/g, '_')
            .slice(0, 100),
        ]),
    );
  }

  private seriesKey(name: string, labels: Record<string, string>): string {
    return `${name}|${JSON.stringify(labels)}`;
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    return entries.length === 0
      ? ''
      : `{${entries.map(([key, value]) => `${key}="${value}"`).join(',')}}`;
  }
}
