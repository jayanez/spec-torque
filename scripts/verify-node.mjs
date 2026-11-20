const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 22 || minor < 20) {
  throw new Error(`Development and qualification require Node 22.20+. Current executable: ${process.execPath} (${process.version}). Use the version in .nvmrc.`);
}
console.log(`Node ${process.version} · ${process.execPath}`);
