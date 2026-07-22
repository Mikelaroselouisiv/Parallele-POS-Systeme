import { MovementType } from '@prisma/client';
import { signedMovementDelta } from './inventory.service';

describe('signedMovementDelta', () => {
  it('signs IN / OUT / ADJUSTMENT for as-of reconstruction', () => {
    expect(signedMovementDelta(MovementType.IN, 5)).toBe(5);
    expect(signedMovementDelta(MovementType.OUT, 3)).toBe(-3);
    expect(signedMovementDelta(MovementType.ADJUSTMENT, 2)).toBe(2);
    expect(signedMovementDelta(MovementType.OUT, -4)).toBe(-4);
  });

  it('reconstructs stock by reversing post-date movements', () => {
    const current = 10;
    // After the as-of date: OUT 3 then IN 2 → signed delta = -3 + 2 = -1
    const deltaAfter =
      signedMovementDelta(MovementType.OUT, 3) + signedMovementDelta(MovementType.IN, 2);
    expect(current - deltaAfter).toBe(11);
  });
});
