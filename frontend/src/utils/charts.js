import Chart from "chart.js/auto";

export function recreateChart(instanceRef, canvas, config) {
  if (!canvas) {
    return;
  }
  if (instanceRef.current) {
    instanceRef.current.destroy();
  }
  instanceRef.current = new Chart(canvas, config);
}

export function destroyChart(instanceRef) {
  if (instanceRef.current) {
    instanceRef.current.destroy();
    instanceRef.current = null;
  }
}