Feature: The Extractor page leads with the upload and shows the map without scrolling
  Issue #92: as an athlete, I want the Extractor page to lead with the GPX upload and show the map
  without scrolling, so that I see my course first and not a long list of samples and options.

  Scenario: The map is inside the viewport on a laptop
    Given the Extractor page on a laptop screen of 1280 by 720
    When it has loaded
    Then at least 300 pixels of the map are visible without scrolling

  Scenario: The sample menu is closed and still usable
    Given the Extractor page on a laptop screen of 1280 by 720
    When it has loaded
    Then the sample menu is closed
    When I open the sample menu
    Then I can choose a sample

  Scenario: A course with several variants offers them in a dropdown
    Given the Extractor page on a laptop screen of 1280 by 720
    And I have opened the sample menu
    When I choose the variant "Lintjes opruimen" of the course "rondje-eilanden"
    Then the description of the course "rondje-eilanden" mentions "island 3 to 5"
    When I choose the variant "Training" of the course "rondje-eilanden"
    Then the description of the course "rondje-eilanden" mentions "GPX to be added"
    And the Load button of the course "rondje-eilanden" is disabled

  Scenario: Terrain data is asked for after my own file, and no keeps it local
    Given the Extractor page on a laptop screen of 1280 by 720
    And the terrain service answers "unavailable"
    When I upload the file "test-data/rhederlaag-swimrun.gpx"
    Then the terrain question is shown with what is sent
    When I answer "No, keep it local"
    Then the terrain question is closed
    And no request went to the terrain service
