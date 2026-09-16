# Tax gross-up note

This is an architecture note, not tax advice. Obtain professional UK advice before implementation.

For a taxable benefit or net amount N where the recipient must be left with N after income tax at marginal rate r, the income-tax gross-up is:

`gross amount = N / (1 - r)`

`tax component = N * r / (1 - r)`

For multiple layers (for example income tax plus employee NIC or other charges), model each applicable layer explicitly rather than adding rates naively. Use the actual tax year, thresholds, allowances, employment status, benefit classification, PAYE mechanics, and corporation-tax treatment.

ITEPA 2003 section 204 is relevant to the valuation rule for taxable benefits provided by reason of employment. The correct treatment depends on the benefit and statutory exceptions; section 204 should not be treated as a universal flat-rate rule. Record assumptions, date the calculation, and have a UK tax adviser confirm the result.

Example only: if N = £100 and r = 40%, gross = £166.67 and tax = £66.67. This excludes NIC, allowances, thresholds, and any statutory valuation rules.
