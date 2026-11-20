Feature: A Pricing page says what is free and what will be paid
  Issue #111: as a swimrunner who wonders what TigerLegs costs, I want a Pricing page that says plainly what is
  free and what will be paid, so that I know I can always extract the segments of my track for free.

  Background:
    Given the Pricing page

  Scenario: The main menu links to the page and marks it as the current page
    Then the main menu has the link "Pricing" marked as the current page

  Scenario: The page starts with the status and what is always free
    Then the page says that TigerLegs is under development, looking for testers and completely free
    And the page says that segment extraction is always free

  Scenario: The page tells why membership exists, with an APA citation after the sentence and the reference at the end
    Then the page says that tigers are endangered, with the citation right after the sentence and the reference at the end

  Scenario: The feature table shows the tiers and the paid-only features in words
    Then the feature table has the columns "Feature", "Free", "Silver", "Gold" and "Platinum"
    And the paid-only features are "Garmin watch integration", "The course of the World Champs in Stockholm" and "Energy station planning"
    And every paid-only feature is not included for Free and included, planned, for Silver, Gold and Platinum
    And segment extraction is included for every tier

  Scenario: The page is labelled as a prototype
    Then the page says that nothing can be bought and that prices and tiers are a draft

  Scenario: The page shows in another language
    When I switch the language to "nl"
    Then the page says that segment extraction is always free in Dutch
