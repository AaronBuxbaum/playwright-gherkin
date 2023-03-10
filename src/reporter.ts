import {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import * as fs from "fs";
import translateFeature, {
  Feature,
  Scenario,
  GherkinData,
} from "./translateFeature";

class GherkinReporter implements Reporter {
  features: GherkinData = {};

  async onBegin(_config: FullConfig, suite: Suite) {
    const files = this.findTestFiles(suite.suites);
    this.features = await translateFeature(files);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const feature = this.getFeature(test);
    if (!feature) return;
    const scenario = this.getScenario(test, feature);
    if (scenario.tags.some((tag) => tag.name === "skip")) return;

    const matchers = result.steps.filter(
      (step) => step.category === "test.step"
    );
    scenario.matchers = matchers;
  }

  onEnd() {
    Object.values(this.features).forEach((feature) => {
      this.checkFeature(feature);
    });
  }

  checkFeature(feature: Feature) {
    feature.scenarios.forEach((scenario) => {
      this.checkScenario(scenario);
    });
  }

  checkScenario({ matchers, steps, uri }: Scenario) {
    if (!steps || !matchers) return;

    this.assert(
      steps.length,
      matchers.length,
      `Not all feature steps have their equivalent matcher!`,
      uri
    );

    for (let i = 0; i < steps.length; i++) {
      this.assert(
        steps[i].text,
        this.handleStepTitle(matchers[i].title),
        `Step ${i} does not match!`,
        uri
      );
    }
  }

  handleTestFilename(filename: string) {
    const [file] = filename.split(".");
    return `${file}.feature`;
  }

  findTestFiles(suites: Suite[], files = new Set<string>()) {
    suites.forEach((suite) => {
      const { location, suites } = suite;
      if (location) {
        const file = this.handleTestFilename(location.file);
        if (fs.existsSync(file)) {
          files.add(file);
        } else {
          console.warn(`${location.file} has no associated feature file!`);
          return;
        }
      }
      if (suites) {
        this.findTestFiles(suites, files);
      }
    });
    return files;
  }

  handleStepTitle(title: string) {
    return title.replace(/^(Given|When|Then|And|But) /, "");
  }

  getFeature(test: TestCase) {
    const filename = this.handleTestFilename(test.location.file);
    const feature = this.features[filename];
    if (!feature) return;

    this.assert(
      feature.document.feature?.name,
      test.parent.title,
      `Feature title does not match!`,
      feature.document.uri
    );
    return feature;
  }

  getScenario(test: TestCase, feature: Feature) {
    if (!feature) {
      throw new Error(
        "getScenario should never be called before feature is set!"
      );
    }

    const scenario = feature.scenarios.find(
      (scenario) => scenario.name === test.title
    );
    if (!scenario) {
      throw new Error(
        `Can't find scenario: ${test.title} in ${feature.document.uri}`
      );
    }
    this.assert(
      test.title,
      scenario.name,
      `Scenario title does not match!`,
      feature.document.uri
    );
    return scenario;
  }

  assert<T>(expected: T, actual: T, explanation: string, path?: string) {
    if (expected !== actual) {
      throw new Error(
        `${explanation}\nExpected "${expected}" but got "${actual}".\nFailed on ${path}`
      );
    }
  }
}

export default GherkinReporter;
