import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exports bounded labelled counters and histograms', () => {
    const service = new MetricsService();
    service.increment('api.requests', { method: 'GET', status: '2xx' });
    service.observe('api.latency', 12, { provider: 'local' });

    const output = service.prometheusText();
    expect(output).toContain('# TYPE api_requests counter');
    expect(output).toContain('api_requests{method="GET",status="2xx"} 1');
    expect(output).toContain('# TYPE api_latency histogram');
    expect(output).toContain('api_latency_count{provider="local"} 1');
  });

  it('does not emit control characters in metric labels', () => {
    const service = new MetricsService();
    service.increment('requests', { route: 'bad\nroute' });
    expect(service.prometheusText()).not.toContain('\nroute');
  });
});
