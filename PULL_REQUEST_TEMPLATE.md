# Title

<!--- Fill title in the form above -->
<!--- Template: [area] ... -->

**Related ticket on Github:** #

**Mention reviewers (and add to reviewers list manually)**
<!--- Please add or remove reviewers so that only people who are interested in this change get notified -->

- @Artemkaaas
- @AlexanderShenshin
- @spivachuk

## Description

<!--- 2 short sentences about what you changed in the code -->

## Checklist:

<!--- Go over all the following points, and put an `x` in all the boxes that apply. -->
<!--- If something does not make sense or does not apply – leave unchecked  --->
<!--- If you're unsure about any of these, don't hesitate to ask. We're here to help! -->

### Mgmt (common)

- [ ] I attached Link to related ticket attached
- [ ] Added list of _reviewers_ to Github reviewers section
- [ ] Added at least one (at most two) _assignees_ to the PR (somebody from the reviewers section)
- [ ] Selected `CBDC DIDComm (Beta)` in `Project` field
  - [ ] Moved this PR into current sprint
  - [ ] Double-checked that the linked issues belongs to the Current sprint

### Code review (common)

- [ ] I think this PR is good and want to submit it for review
- [ ] I have looked through this PR myself and fixed issues that I found during manual review
- [ ] I have already documented questions or places in the code that I do not feel confident about

### Documentation & design (common)

- [ ] My change corresponds to design decisions from `cbdc-design` or `cbdc-projects` repo
- [ ] My change requires a change to the documentation.
  - [ ] I have updated the documentation accordingly (attach a link to PR with changes)
  - [ ] I have created a corresponding task to update documentation and assigned it to responsible person (attach a link to task)

### Development (specific to Aries Framework Repo)

- I have properly tested my changes
  - [ ] I have tested on a demo app
    - [ ] I also build mobile apps and tested real transactions on a real Android device
    - [ ] I also build mobile apps and tested real transactions on a real IOS device
  - [ ] I built my code on Windows
  - [ ] I built tested on Mac OS
  - [ ] I built my code on Linux
- [ ] I have considered platform differences
  - [ ] I'm using environment-aware scripts (bash, env, build scripts)

### Dependencies (specific to Aries Framework Repo)

- This PR depends on other PRs (check only relevant items)
  - [ ] [VTP library PR](PR link)
  - [ ] [Gossip library PR](PR link)
  - [ ] [Backend apps PR](PR link)
  - [ ] All the other PR's have been merged in, so it's time to merge Aries Framework too
- This PR requires us to also update
  - [ ] Update Mobile applications
    - [ ] [Mobile Apps PR link](PR Link)
    - [ ] [Backend Apps PR link](PR Link)

### Versioning and backwards compatibility (specific to Mobile repo)

- Backwards compatibility (check only one)
  - [ ] This PR breaks compatibility with older version of Aries Framework Javascript
  - [ ] This PR will be compatible with older version of Aries Framework Javascript
- Do we need to bump major app version?
  - [ ] Small change, bumping only minor version via CI script is fine (need to be done manuall)
  - [ ] Larger change, so need to bump major version (need to be done manually)

## Screenshots:

<!--- Attach a screenshot of new screens or UI changes -->
