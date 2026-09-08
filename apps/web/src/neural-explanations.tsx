import React from "react";

/** Shared neuroscience explanations; control help belongs beside the controls. */
export function NeuralExplanations() {
  return (
    <>
      <details>
        <summary>What do these numbers mean?</summary>
        <p>
          A neuron has a voltage difference across its outer membrane. Incoming signals change that
          voltage. In a leaky integrate-and-fire model, inputs accumulate while the voltage also
          drifts back toward its resting value. Crossing a threshold produces a brief signal called
          a spike.
        </p>
        <p>
          After a spike, the model resets its voltage and briefly prevents another spike. This
          represents a refractory period. A voltage dip can therefore follow a neuron firing—it does
          not necessarily mean the neuron received less input.
        </p>
        <p>
          “Voltage” is the average model voltage across this group. “Firing” is the fraction of its
          neurons that spiked during one update. A group average can hide differences between
          individual cells, and this fraction is not a firing rate in spikes per second.
        </p>
        <p>
          <a
            href="https://neuronaldynamics.epfl.ch/online/Ch1.S3.html"
            target="_blank"
            rel="noreferrer"
          >
            Read about integrate-and-fire neurons
          </a>
        </p>
      </details>
      <details>
        <summary>How do neurons influence one another?</summary>
        <p>
          Neurons communicate through connections called synapses. An excitatory connection tends to
          make the receiving neuron more likely to fire; an inhibitory connection tends to make it
          less likely. Many inputs combine in the same cell.
        </p>
        <p>
          These words describe an effect on another neuron, not a behavior such as attraction or
          avoidance. Inhibiting a neuron that inhibits another cell can have an indirect excitatory
          effect. The result depends on the surrounding circuit.
        </p>
        <p>
          <a href="https://www.ncbi.nlm.nih.gov/books/NBK11117/" target="_blank" rel="noreferrer">
            Read about excitation and inhibition
          </a>
        </p>
      </details>
      <details>
        <summary>What comes from a real fly?</summary>
        <p>
          The connectome is a map of neurons and their connections reconstructed from MaleCNS data.
          It describes wiring, not a recording of what every neuron was doing.
        </p>
        <p>
          The changing voltages here come from a simplified model running on selected wiring.
          Synaptic signs, input currents and activity summaries include modeling assumptions. The
          voltage units and update timing are not measurements of a living fly. A pathway label
          alone does not establish its biological function.
        </p>
        <p>
          Sensory signals enter selected neuron groups as modeled electrical input. Here, attractive
          odor and the local exit cue drive excitatory-labeled odor groups and repellent odor drives
          inhibitory-labeled groups, following measured responses of this simulated circuit. This
          binding is a modeling assumption: excitation and inhibition describe effects between
          neurons, not a universal preference for a smell. Odor and visual inputs can arrive
          together and combine in a neuron.
        </p>
      </details>
    </>
  );
}
