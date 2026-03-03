function tailorEarningsExpressionWithRule(dayHoursPath = "$dayHours", rulePath = "$chosenRule") {
  const asNumber = (expr, fallback) => ({
    $convert: { input: expr, to: "double", onError: fallback, onNull: fallback }
  });

  return {
    $let: {
      vars: {
        slabsRaw: { $ifNull: [`${rulePath}.config.slabs`, [3, 4, 5]] },
        ratesRaw: { $ifNull: [`${rulePath}.config.rates`, [100, 150, 200]] }
      },
      in: {
        $let: {
          vars: {
            s0: asNumber({ $arrayElemAt: ["$$slabsRaw", 0] }, 3),
            s1: asNumber({ $arrayElemAt: ["$$slabsRaw", 1] }, 4),
            s2: asNumber({ $arrayElemAt: ["$$slabsRaw", 2] }, 5),
            r0: asNumber({ $arrayElemAt: ["$$ratesRaw", 0] }, 100),
            r1: asNumber({ $arrayElemAt: ["$$ratesRaw", 1] }, 150),
            r2: asNumber({ $arrayElemAt: ["$$ratesRaw", 2] }, 200)
          },
          in: {
            $multiply: [
              dayHoursPath,
              {
                $switch: {
                  branches: [
                    { case: { $lt: [dayHoursPath, "$$s1"] }, then: "$$r0" },
                    {
                      case: {
                        $and: [{ $gte: [dayHoursPath, "$$s1"] }, { $lt: [dayHoursPath, "$$s2"] }]
                      },
                      then: "$$r1"
                    }
                  ],
                  default: "$$r2"
                }
              }
            ]
          }
        }
      }
    }
  };
}

function butcherCutsExpressionWithRule(dayHoursPath = "$dayHours", rulePath = "$chosenRule") {
  const asNumber = (expr, fallback) => ({
    $convert: { input: expr, to: "double", onError: fallback, onNull: fallback }
  });

  return {
    $multiply: [dayHoursPath, asNumber({ $ifNull: [`${rulePath}.config.cutsPerHour`, 200] }, 200)]
  };
}

module.exports = {
  tailorEarningsExpressionWithRule,
  butcherCutsExpressionWithRule
};
