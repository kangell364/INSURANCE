#!/usr/bin/env python3
"""Assertions for the statute extractor's text cleanup.

Run: python3 scripts/test-extract-statute.py

The filler glyph in the source PDFs is a capital "A" standing in for a
non-breaking space, which puts it in direct collision with the most common
one-letter word in English legal drafting. Every case below is real text from
a chapter in reference/statutes/ -- both the filler that must go and the
articles, labels and proper nouns that must survive.
"""
import re, sys

sys.path.insert(0, __file__.rsplit('/', 1)[0])
import importlib.util
spec = importlib.util.spec_from_file_location(
    'extract_statute', __file__.rsplit('/', 1)[0] + '/extract-statute.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
clean = mod.clean

failures = []


def check(name, raw, must_contain=(), must_not_contain=()):
    got = clean(raw)
    for needle in must_contain:
        if needle not in got:
            failures.append(f'{name}: expected {needle!r}\n  in: {got!r}')
    for needle in must_not_contain:
        if needle in got:
            failures.append(f'{name}: did not expect {needle!r}\n  in: {got!r}')


# --- the filler must go -------------------------------------------------

check('filler after a subsection label',
      'Sec. 1806.104. PROHIBITED ACTS. (c) AA An insured named in a policy',
      must_contain=['(c) An insured named'], must_not_contain=['AA'])

check('filler after a numbered paragraph',
      'The commissioner shall: (1) AA coordinate the implementation',
      must_contain=['(1) coordinate'], must_not_contain=['AA'])

check('filler after a lettered paragraph',
      'including: (A) AA the nature, circumstances',
      must_contain=['(A) the nature'], must_not_contain=['AA'])

check('filler before a section heading',
      'Sec. A 981.001. AA PURPOSE. The purpose of this chapter',
      must_contain=['Sec. 981.001. PURPOSE.'], must_not_contain=['AA', 'Sec. A'])

check('filler after a heading ending in a word',
      'Sec. 1806.053. DISCRIMINATIONS OR DISTINCTIONS. AA Except as provided',
      must_contain=['DISTINCTIONS. Except as provided'], must_not_contain=['AA'])

check('filler mid-sentence between sentences',
      'The certificate must: AA be in the form prescribed',
      must_contain=['must: be in the form'], must_not_contain=['AA'])

# --- real text must survive ---------------------------------------------
#
# This is the half that the first version of the extractor got wrong. Each of
# these is a place where deleting the "A" changes the meaning of a statute.

check('the article opening a subsection',
      'Sec. 1806.156. CRIMINAL PENALTY. (a) A person commits an offense if',
      must_contain=['(a) A person commits an offense'])

check('the article opening a subsection, with filler present too',
      'FINANCIAL CONDITION. (b) AA A material and intentional change',
      must_contain=['(b) A material and intentional change'],
      must_not_contain=['AA'])

check('the article after a numbered paragraph',
      'may not: (1) A person who solicits an application',
      must_contain=['(1) A person who solicits'])

check('a subchapter designator',
      'SUBTITLE A. GENERAL PROVISIONS SUBCHAPTER A. GENERAL PROVISIONS',
      must_contain=['SUBCHAPTER A.'])

check('a financial strength rating',
      'a financial strength rating of A- or better from the A. M. Best Company',
      must_contain=['rating of A- or better', 'A. M. Best Company'])

check('a bare (A) label with no filler',
      'resulting from: (A) a steam boiler; (B) a heater',
      must_contain=['(A) a steam boiler', '(B) a heater'])

check('a section number containing a letter',
      'Ch. 1276, Sec. 10A.228(a), eff. September 1, 2007',
      must_contain=['Sec. 10A.228(a)'])

# --- structure ----------------------------------------------------------

check('sections are broken onto their own paragraphs',
      'eff. April 1, 2007. Sec. 1806.002. CONSTRUCTION. Nothing in this',
      must_contain=['2007.\n\nSec. 1806.002.'])

check('subsections are broken onto their own lines',
      'Sec. 1806.055. PROFIT SHARING. (a) Section 1806.054 does not prohibit '
      'an insurer. (b) An insurer may not discriminate.',
      must_contain=['\n(a) Section 1806.054', '\n(b) An insurer may not'])

if failures:
    print(f'{len(failures)} failed:\n')
    print('\n\n'.join(failures))
    sys.exit(1)
print('extract-statute: all assertions passed')
