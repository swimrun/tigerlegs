Feature: A Pricing page says what is free and what will be paid
  Issue #111: as a swimrunner who wonders what TigerLegs costs, I want a Pricing page that says plainly what is
  free and what will be paid, so that I know I can always extract the segments of my track for free.

  Background:
    Given the Pricing page

  Scenario: The main menu links to the page and marks it as the current page
    Then the main menu has the link "Pricing" marked as the current page

  Scenario: The page starts with the status and what is always free
    Then the page says that TigerLegs is under development, looking for testers and completely free, and that in beta everyone may try it if they report issues to Bart
    And the page says that segment extraction is always free

  Scenario: The page tells why membership exists, with an APA citation after the sentence and the reference at the end
    Then the page says that tigers are endangered, with the citation right after the sentence and the reference at the end

  Scenario: The feature table shows the tiers with their prices
    Then the feature table has the columns "Feature", "Free €0", "Silver €5", "Gold €10" and "Platinum €25"

  Scenario: The feature table shows what is included with a green check and what is not with a red cross
    Then the feature "Segment extraction: swims and runs, distances, map and table" is included for every tier with a green check
    And the feature "Garmin watch integration" is not included for Free with a red cross and included for Silver, Gold and Platinum
    And the feature "Extended access to swimrun courses, like that of the ÖTILLÖ World Championships" is included for Gold and Platinum only

  Scenario: Hosting your profile is in the free tier and energy station planning is limited per tier
    Then the feature "Hosted profile" is included for every tier with a green check
    And the feature "Energy station planning, for a number of courses or races" has the limits "Max. 2", "Max. 5", "Max. 10" and "Unlimited"

  Scenario: The page pledges part of the contributions to tiger conservation, with the quote and its citation
    Then the page pledges part of the contributions for paid features to the IUCN, with the 25,000 quote cited

  Scenario: The tiger photo is credited with its author and licence
    Then the tiger photo is credited to "Rahulsharma photography" under CC BY-SA 4.0 with links to the source and the licence

  Scenario: The page explains the hosting costs
    Then the page explains that a back end that hosts profiles has hosting costs

  Scenario: The chat offers questions about pricing on this page
    Then the chat offers the question "What will Silver, Gold and Platinum cost?"

  Scenario: The page is labelled as a prototype
    Then the page says that nothing can be bought and that prices and tiers are a draft

  Scenario: The page shows in another language
    When I switch the language to "nl"
    Then the page says that segment extraction is always free in Dutch
