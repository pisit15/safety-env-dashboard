/**
 * Deterministic board token for Near Miss public employee board.
 * URL: /report/nearmiss/[companyId]/board  (noindex, token-based in future)
 *
 * generate(): used in coordinator view to build shareable board URL
 * resolve(): used in board API to validate and return companyId
 */
import { createHmac } from 'crypto';

const SECRET = process.env.BOARD_TOKEN_SECRET || 'nearmiss-board-ea-dashboard';

/** Generate a 12-char hex token from companyId */
export function getBoardToken(companyId: string): string {
  return createHmac('sha256', SECRET).update(companyId.toLowerCase()).digest('hex').slice(0, 12);
}

/** Given a token, find the matching companyId from the list */
export function resolveToken(token: string, companyIds: string[]): string | null {
  return companyIds.find(id => getBoardToken(id) === token) ?? null;
}
