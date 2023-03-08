import {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import translateFeature, { Feature, GherkinData } from "./translateFeature";

class GherkinReporter implements Reporter {
  features: GherkinData = {};

  async onBegin(_config: FullConfig, suite: Suite) {
    const files = this.findTestFiles(suite.suites);
    this.features = await translateFeature(files);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const feature = this.getFeature(test);
    const scenario = this.getScenario(test, feature);
    if (scenario.tags.some((tag) => tag.name === "skip")) return;

    const steps = result.steps.filter((step) => step.category === "test.step");
    this.assert(
      steps.length,
      scenario.steps.length,
      `Not all feature steps have their equivalent matcher!`,
      feature
    );

    for (let i = 0; i < steps.length; i++) {
      this.assert(
        scenario.steps[i].text,
        this.handleStepTitle(steps[i].title),
        `Step ${i} does not match!`,
        feature
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
        files.add(this.handleTestFilename(location.file));
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
    if (!feature) {
      throw new Error(`Can't find feature file: ${filename}`);
    }
    this.assert(
      feature.document.feature?.name,
      test.parent.title,
      `Feature title does not match!`,
      feature
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
      feature
    );
    return scenario;
  }

  assert<T>(expected: T, actual: T, explanation: string, feature: Feature) {
    if (expected !== actual) {
      throw new Error(
        `${explanation}\nExpected "${expected}" but got "${actual}".\nFailed on ${feature.document.uri}`
      );
    }
  }
}

export default GherkinReporter;
