// Initialize Vercel Speed Insights
import { injectSpeedInsights } from './speed-insights.mjs';

// Inject Speed Insights when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectSpeedInsights();
  });
} else {
  injectSpeedInsights();
}
