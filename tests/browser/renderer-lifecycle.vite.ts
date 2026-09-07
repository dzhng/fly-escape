export default {
  root: ".",
  build: {
    outDir: "/tmp/fly-renderer-lifecycle-dist",
    emptyOutDir: true,
    rolldownOptions: { input: "tests/browser/renderer-lifecycle.html" },
  },
};
