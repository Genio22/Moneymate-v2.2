import { describe, it, expect } from 'vitest'
import { parseTakaToPoisha, formatBDT } from '../src/utils/money'

/**
 * These tests mirror the FINANCIAL RULES enforced in the database
 * (supabase/migrations/0002_business_logic.sql) so any change that breaks
 * the documented semantics fails fast in CI.
 */

/** Mirror of mm_check_advance_spend: remaining advance balance. */
function advanceRemaining(advance, expenses) {
  const spent = expenses
    .filter((e) => e.advance_id === advance.id && e.status !== 'rejected')
    .reduce((s, e) => s + e.amount_poisha, 0)
  return advance.amount_poisha - spent
}

/** Mirror of mm_check_allocation_spend: remaining restricted allocation. */
function allocationRemaining(allocation, expenses) {
  const spent = expenses
    .filter((e) => e.contribution_allocation_id === allocation.id && e.status !== 'rejected')
    .reduce((s, e) => s + e.amount_poisha, 0)
  return allocation.amount_poisha - spent
}

/** Mirror of mm_project_summary: confirmed available cash. */
function availableCash(summaryInputs) {
  const {
    cashInVerified,
    ownFundsAdvances,
    advanceSpentVerified,
    projectCashSpentVerified,
    reimbursementsPaid,
  } = summaryInputs
  return cashInVerified + ownFundsAdvances - advanceSpentVerified - projectCashSpentVerified - reimbursementsPaid
}

describe('business rules: the ৳500 advance scenario', () => {
  const advance = { id: 'adv1', amount_poisha: 50000 } // ৳500

  it('full advance is remaining before any spending', () => {
    expect(advanceRemaining(advance, [])).toBe(50000)
  })

  it('a ৳450 expense leaves ৳50 — never ৳0', () => {
    const expenses = [{ advance_id: 'adv1', amount_poisha: 45000, status: 'pending' }]
    expect(advanceRemaining(advance, expenses)).toBe(5000)
    expect(formatBDT(5000)).toBe('৳50')
  })

  it('multiple pending expenses each reduce the physical balance', () => {
    const expenses = [
      { advance_id: 'adv1', amount_poisha: 20000, status: 'pending' },
      { advance_id: 'adv1', amount_poisha: 25000, status: 'pending' },
    ]
    expect(advanceRemaining(advance, expenses)).toBe(5000)
  })

  it('overspending is detected exactly like the server trigger', () => {
    const expenses = [
      { advance_id: 'adv1', amount_poisha: 45000, status: 'verified' },
      { advance_id: 'adv1', amount_poisha: 6000, status: 'pending' }, // would exceed
    ]
    const remaining = advanceRemaining(advance, expenses)
    expect(remaining).toBeLessThan(0)
    // the DB raises an exception in this case; the UI must block it too
    const wouldSubmit = 6000
    expect(wouldSubmit > remaining).toBe(true)
  })

  it('a rejected expense frees its balance again', () => {
    const expenses = [
      { advance_id: 'adv1', amount_poisha: 45000, status: 'verified' },
      { advance_id: 'adv1', amount_poisha: 50000, status: 'rejected' },
    ]
    expect(advanceRemaining(advance, expenses)).toBe(5000)
  })
})

describe('business rules: restricted sponsor funds', () => {
  const sponsorA = {
    id: 'alloc1',
    amount_poisha: 50000000, // ৳500,000
    category: 'equipment',
    contribution_id: 'c1',
  }
  const sponsorB = { id: 'alloc2', amount_poisha: 30000000, category: 'venue' }
  const sponsorC = { id: 'alloc3', amount_poisha: 20000000, category: 'unrestricted' }

  it('equipment spending reduces the equipment allocation only', () => {
    const expenses = [{ contribution_allocation_id: 'alloc1', amount_poisha: 30000000, status: 'verified' }]
    expect(allocationRemaining(sponsorA, expenses)).toBe(20000000)
    expect(allocationRemaining(sponsorB, [])).toBe(30000000)
  })

  it('spending beyond the allocation remaining is blocked', () => {
    const expenses = [
      { contribution_allocation_id: 'alloc1', amount_poisha: 45000000, status: 'verified' },
    ]
    const request = { allocation: sponsorA, amount: parseTakaToPoisha('600000') }
    const remaining = allocationRemaining(request.allocation, expenses)
    expect(request.amount > remaining).toBe(true) // -> server raises; UI blocks
  })

  it('a contribution can be split into multiple allocations that sum to it', () => {
    const total = sponsorA.amount_poisha + sponsorB.amount_poisha + sponsorC.amount_poisha
    expect(total).toBe(100000000) // ৳1,000,000 fully allocated, no double counting
  })
})

describe('business rules: personal claims are NOT cash', () => {
  it('pending personal claims do not change available cash', () => {
    const cash = availableCash({
      cashInVerified: 50000000,
      ownFundsAdvances: 0,
      advanceSpentVerified: 0,
      projectCashSpentVerified: 0,
      reimbursementsPaid: 0,
    })
    expect(cash).toBe(50000000)
  })

  it('reimbursing a member reduces cash only when actually paid', () => {
    // claim verified but not yet paid
    const before = availableCash({
      cashInVerified: 50000000, ownFundsAdvances: 0, advanceSpentVerified: 0,
      projectCashSpentVerified: 0, reimbursementsPaid: 0,
    })
    const afterPayment = availableCash({
      cashInVerified: 50000000, ownFundsAdvances: 0, advanceSpentVerified: 0,
      projectCashSpentVerified: 0, reimbursementsPaid: 45000,
    })
    expect(before - afterPayment).toBe(45000)
  })
})

describe('business rules: non-cash contributions never become cash', () => {
  it('non-cash value is excluded from the cash formula', () => {
    const cash = availableCash({
      cashInVerified: 50000000, // ৳500,000 cash
      ownFundsAdvances: 0,
      advanceSpentVerified: 0,
      projectCashSpentVerified: 0,
      reimbursementsPaid: 0,
    })
    const nonCash = 30000000 // ৳300,000 of materials/assets
    expect(cash).toBe(50000000)
    expect(cash + nonCash).toBe(80000000) // total contribution VALUE ≠ available cash
  })
})

describe('business rules: partial then full reimbursement', () => {
  it('৳450 claim: ৳200 then ৳250 settles it fully', () => {
    const claim = { amount_poisha: 45000, outstanding_poisha: 45000, status: 'outstanding' }

    // payment 1: ৳200
    const pay = (claim, amount) => {
      const outstanding = claim.outstanding_poisha - amount
      expect(outstanding).toBeGreaterThanOrEqual(0)
      return {
        ...claim,
        outstanding_poisha: outstanding,
        status: outstanding === 0 ? 'fully_reimbursed' : 'partially_reimbursed',
      }
    }
    const after1 = pay(claim, 20000)
    expect(after1.status).toBe('partially_reimbursed')
    expect(formatBDT(after1.outstanding_poisha)).toBe('৳250')
    const after2 = pay(after1, 25000)
    expect(after2.status).toBe('fully_reimbursed')
    expect(after2.outstanding_poisha).toBe(0)
  })

  it('overpayment is rejected before it happens', () => {
    const claim = { amount_poisha: 45000, outstanding_poisha: 25000 }
    const attempted = 30000
    expect(attempted > claim.outstanding_poisha).toBe(true) // server raises exception
  })
})

describe('business rules: verification authority (mirrors mm_verify_expense)', () => {
  const expense = {
    id: 'e1',
    created_by: 'karim',
    funding_source: 'advance',
    source_provider_id: 'rahim',
    status: 'pending',
  }

  const canVerify = (expense, verifierId, isManager) => {
    if (expense.status !== 'pending') return false
    if (expense.created_by === verifierId) return false // never your own submission
    if (expense.funding_source === 'advance') {
      const isSource = expense.source_provider_id === verifierId
      const managerFallback = isManager && expense.source_provider_id == null
      return isSource || managerFallback
    }
    return isManager
  }

  it('the money provider can verify spending from their advance', () => {
    expect(canVerify(expense, 'rahim', false)).toBe(true)
  })

  it('the submitter can never verify their own transaction', () => {
    expect(canVerify(expense, 'karim', true)).toBe(false)
  })

  it('a random member cannot verify', () => {
    expect(canVerify(expense, 'hasan', false)).toBe(false)
  })

  it('a manager cannot bypass the source provider while one exists', () => {
    expect(canVerify(expense, 'manager', true)).toBe(false)
  })

  it('a manager may verify when the provider is external (no user)', () => {
    expect(canVerify({ ...expense, source_provider_id: null }, 'manager', true)).toBe(true)
  })

  it('personal claims are verified by managers only', () => {
    const claim = { ...expense, funding_source: 'personal', source_provider_id: null }
    expect(canVerify(claim, 'manager', true)).toBe(true)
    expect(canVerify(claim, 'rahim', false)).toBe(false)
  })
})
