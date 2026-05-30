/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

class DrivingSafety {
  static laneIndexFor(road, x) {
    if (!road?.laneCount) return 0;
    const laneWidth = road.width / road.laneCount;
    return Math.min(road.laneCount - 1, Math.max(0, Math.floor((x - road.left) / laneWidth)));
  }

  static analyze(car, road, traffic) {
    const laneWidth = road.width / road.laneCount;
    const laneIndex = DrivingSafety.laneIndexFor(road, car.x);
    const laneCenter = road.getLaneCenter(laneIndex);
    const laneOffset = (car.x - laneCenter) / Math.max(1, laneWidth / 2);
    const lanes = Array.from({ length: road.laneCount }, (_, index) =>
      DrivingSafety.#laneSnapshot(car, road, traffic, index)
    );
    const current = lanes[laneIndex] || { frontGap: Infinity, rearGap: Infinity, sideRisk: false };
    const left = laneIndex > 0 ? lanes[laneIndex - 1] : null;
    const right = laneIndex < road.laneCount - 1 ? lanes[laneIndex + 1] : null;
    const frontGap = current.frontGap;
    const criticalDistance = Math.max(95, car.height * 2.1 + car.speed * 24);
    const cautionDistance = Math.max(185, car.height * 3.5 + car.speed * 42);
    const risk =
      frontGap < criticalDistance ? "emergency" : frontGap < cautionDistance ? "caution" : "clear";

    return {
      laneIndex,
      laneCenter,
      laneOffset,
      laneWidth,
      current,
      left,
      right,
      frontGap,
      criticalDistance,
      cautionDistance,
      risk,
    };
  }

  static refine({ car, road, traffic, neuralOutputs }) {
    const analysis = DrivingSafety.analyze(car, road, traffic);
    const wantsLeft = Boolean(neuralOutputs?.[1]);
    const wantsRight = Boolean(neuralOutputs?.[2]);
    const frontBlocked = analysis.risk !== "clear";
    const leftOpen = Boolean(analysis.left && !analysis.left.sideRisk);
    const rightOpen = Boolean(analysis.right && !analysis.right.sideRisk);

    let left = false;
    let right = false;
    let forward = neuralOutputs?.[0] !== 0;

    if (frontBlocked) {
      const leftScore = leftOpen
        ? analysis.left.frontGap + analysis.left.rearGap * 0.25
        : -Infinity;
      const rightScore = rightOpen
        ? analysis.right.frontGap + analysis.right.rearGap * 0.25
        : -Infinity;

      if (leftScore > rightScore && leftScore > analysis.frontGap + 35) {
        left = true;
      } else if (rightScore > analysis.frontGap + 35) {
        right = true;
      }

      forward = analysis.risk !== "emergency";
    } else if (wantsLeft && !wantsRight && leftOpen) {
      left = true;
    } else if (wantsRight && !wantsLeft && rightOpen) {
      right = true;
    }

    if (!left && !right) {
      const centeringThreshold = frontBlocked ? 0.08 : 0.16;
      if (analysis.laneOffset > centeringThreshold) {
        left = true;
      } else if (analysis.laneOffset < -centeringThreshold) {
        right = true;
      } else if (Math.abs(car.angle) > 0.08) {
        if (car.angle > 0) right = true;
        else left = true;
      }
    }

    if (left && right) {
      const leftScore = leftOpen ? analysis.left.frontGap : -Infinity;
      const rightScore = rightOpen ? analysis.right.frontGap : -Infinity;
      left = leftScore >= rightScore;
      right = !left;
    }

    return {
      forward,
      left,
      right,
      reverse: false,
      risk: analysis.risk,
      frontGap: Number.isFinite(analysis.frontGap) ? analysis.frontGap : null,
      laneOffset: analysis.laneOffset,
    };
  }

  static #laneSnapshot(car, road, traffic, laneIndex) {
    const laneCenter = road.getLaneCenter(laneIndex);
    const laneWidth = road.width / road.laneCount;
    let frontGap = Infinity;
    let rearGap = Infinity;
    let sideRisk = false;

    for (const trafficCar of traffic) {
      const lateralDistance = Math.abs(trafficCar.x - laneCenter);
      if (lateralDistance > laneWidth * 0.38) continue;

      const gap = car.y - trafficCar.y;
      if (gap > 0) frontGap = Math.min(frontGap, gap);
      else rearGap = Math.min(rearGap, Math.abs(gap));

      if (gap > -95 && gap < 165) {
        sideRisk = true;
      }
    }

    return { frontGap, rearGap, sideRisk };
  }
}
