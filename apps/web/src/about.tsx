import React from "react";
import "./about.css";

export function About() {
  return (
    <main className="about-page">
      <a href="/">Back to the game</a>
      <h1>About the data and models</h1>
      <p>
        Help the Fly Escape combines a real fly connectivity dataset with a simplified neural
        simulation and an authored game world.
      </p>
      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Real connectivity data</h2>
        <p>
          The graph is a selected subgraph of Janelia FlyEM’s MaleCNS v1.0 connectome. It uses
          neuron annotations, predicted neurotransmitters and measured connection weights. It is not
          the complete nervous system or a recording of a living fly’s activity.
        </p>
        <p>
          The source project credits FlyEM at HHMI Janelia, the University of Cambridge, the MRC
          Laboratory of Molecular Biology and Google Research. Its{" "}
          <a href="https://male-cns.janelia.org/download/">dataset download page</a> identifies the
          data as{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">
            Creative Commons Attribution 4.0
          </a>
          .
        </p>
        <p>
          The <a href="/brain/manifest.json">bundled graph manifest</a> identifies this build’s
          source files, checksums, extraction rules and graph hash. Connections are selected and
          transformed into signed incoming weights for simulation; missing transmitter annotations
          use the exporter’s documented fallback.
        </p>
      </section>
      <section aria-labelledby="models-heading">
        <h2 id="models-heading">What the simulation adds</h2>
        <p>
          Each fly has independent leaky integrate-and-fire neuron state and noise. These equations
          approximate electrical activity; the connectome alone does not specify a complete
          biological brain. See{" "}
          <a href="https://neuronaldynamics.epfl.ch/online/Ch1.S3.html">
            Neuronal Dynamics: integrate-and-fire models
          </a>{" "}
          for the model family.
        </p>
        <p>
          Odor, light and contact are modeled signals mapped to selected neural groups. Neural
          readouts drive movement and behavioral transitions. Sensory gains, movement decoding,
          collisions, feeding and energy reserves are simplified game models. Their behavior is not
          a validated prediction of an animal’s behavior.
        </p>
        <p>
          The activity panels show simulated state and connectivity summaries. They do not measure a
          real fly or establish that a named circuit has the same function in every biological
          context.
        </p>
      </section>
      <section aria-labelledby="art-heading">
        <h2 id="art-heading">Authored world and artwork</h2>
        <p>
          The fly, house and food models were created for this project in Blender and exported as
          GLB assets. Their shapes, animation, colors and scale are illustrative artwork, not
          reconstructions from the connectome dataset.
        </p>
        <p>
          The browser runs the simulation locally from bundled data and assets. It needs no
          application backend. The dataset’s license applies to the source data; this page does not
          assign a license to the project’s code or artwork.
        </p>
      </section>
    </main>
  );
}
