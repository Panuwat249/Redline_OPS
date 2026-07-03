function updateChart(items) {
    const labels = items.map(item => item.month);

    const onTimeValues = items.map(item => item.onTime.total);
    const reliabilityValues = items.map(item => item.reliability.total);
    const availabilityValues = items.map(item => item.availability.total);

    const ctx = document.getElementById("performanceChart");

    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: "bar",

        data: {
            labels: labels,

            datasets: [
                {
                    label: "ความต่อต่อเวลา",
                    data: onTimeValues,
                    backgroundColor: "rgba(239, 35, 60, 0.88)",
                    borderColor: "rgba(181, 18, 27, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },
                {
                    label: "ความน่าเชื่อถือ",
                    data: reliabilityValues,
                    backgroundColor: "rgba(123, 44, 191, 0.88)",
                    borderColor: "rgba(91, 33, 182, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                },
                {
                    label: "ความพร้อมของขบวนรถไฟ",
                    data: availabilityValues,
                    backgroundColor: "rgba(0, 119, 182, 0.88)",
                    borderColor: "rgba(3, 105, 161, 1)",
                    borderWidth: 1,
                    borderRadius: 14,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#334155",
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 24,
                        font: {
                            family: "Sarabun",
                            size: 14,
                            weight: "bold"
                        }
                    }
                },

                tooltip: {
                    backgroundColor: "#111827",
                    titleColor: "#ffffff",
                    bodyColor: "#ffffff",
                    padding: 14,
                    cornerRadius: 14,
                    titleFont: {
                        family: "Sarabun",
                        size: 14,
                        weight: "bold"
                    },
                    bodyFont: {
                        family: "Sarabun",
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            },

            scales: {
                y: {
                    min: 90,
                    max: 100,
                    ticks: {
                        color: "#64748b",
                        callback: function(value) {
                            return value + "%";
                        },
                        font: {
                            family: "Sarabun",
                            weight: "bold"
                        }
                    },
                    grid: {
                        color: "rgba(148, 163, 184, 0.22)"
                    },
                    border: {
                        display: false
                    }
                },

                x: {
                    ticks: {
                        color: "#475569",
                        font: {
                            family: "Sarabun",
                            weight: "bold"
                        }
                    },
                    grid: {
                        display: false
                    },
                    border: {
                        display: false
                    }
                }
            }
        }
    });
}
