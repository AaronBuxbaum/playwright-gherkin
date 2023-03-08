import type cucumber from "cucumber-messages";
import gherkin from "gherkin";

export type GherkinData = Record<string, Feature>;
export type Scenario = cucumber.messages.Pickle;
export type Document = cucumber.messages.GherkinDocument;

export interface Feature {
  document: Document;
  scenarios: Scenario[];
}

const translateFeature = (files: Set<string>) =>
  new Promise<GherkinData>((resolve) => {
    const features: GherkinData = {};

    const stream = gherkin.fromPaths([...files], {
      includeGherkinDocument: true,
      includeSource: false,
      includePickles: true,
    });

    stream.on("data", ({ gherkinDocument, pickle }) => {
      if (gherkinDocument) {
        features[gherkinDocument.uri] = {
          document: gherkinDocument,
          scenarios: [],
        };
      }

      if (pickle) {
        features[pickle.uri].scenarios.push(pickle);
      }
    });

    stream.on("end", () => {
      resolve(features);
    });
  });

export default translateFeature;
