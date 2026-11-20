Feature: A bar under the map shows the legs, as on Race Day Map
  Issue #94: as a swimrunner, I want to see the legs of my track in a bar under the map, with the type and length of
  a leg in a panel when I hover it, so that I see how the course was split at a glance.

  Background:
    Given the Extractor page on a laptop screen of 1280 by 720
    And I have opened the sample menu
    And I have loaded the sample of the course "rondje-eilanden"

  Scenario: The legs show in blue for swims and green for runs
    Then the legs bar shows swim legs and run legs

  Scenario: Hovering a leg shows its type and distance
    When I hover the first swim leg
    Then the leg panel shows "Swim" and a distance

  Scenario: A leg can be reached and chosen with the keyboard
    When I focus the first run leg with the keyboard
    Then the leg panel shows "Run" and a distance
    When I press Enter on the focused leg
    Then that leg is selected

  Scenario: A screen reader reads the type, number and distance of a leg
    Then every leg has a label with its type, number and distance
