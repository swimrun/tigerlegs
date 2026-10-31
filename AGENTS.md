# Agent instructions

Follow the project standards in [AGENT.md](./AGENT.md).

## Keep generated files inside this repository

- Always save generated images, screenshots, exports, scratch files and other task-created files inside this repository.
- Never use `/tmp`, `/private/tmp`, the operating system's temporary directory or an external session folder for these files.
- Save website images in `public/img/`, GPX sample data in `test-data/` and temporary test fixtures in `test/fixtures/`.
- If a tool automatically saves output outside the repository and offers no destination setting, copy the needed output into the repository immediately. Do not use the external copy as the project asset.
- Remove task-created temporary files after use; do not delete unrelated files.
