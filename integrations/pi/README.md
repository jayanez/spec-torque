# SpecTorque for Pi and ThinkRail

`/spectorque [feature | folder | --changed [base]]` shows scores and a widget, lets you pick a finding and its exact evidence, and applies a refinement only after you confirm the before and after wording. In headless contexts the command returns a report without triggering a model turn. Three author/review/refine skills are included. No model or credentials are needed for the baseline.

## Install

```sh
pi install npm:pi-spectorque@<version>
```

Add `--local` to install for one project. In ThinkRail, install `pi-spectorque` from the extensions catalog or with the same command, then trust the project. Remove with `pi remove npm:pi-spectorque`.

From a source checkout, build and package the repository first, then load `pi --extension /absolute/spectorque/integrations/pi/index.ts` or install the generated package. Consult the repository [compatibility matrix](https://github.com/jayanez/spec-torque/blob/develop/docs/compatibility.md) before claiming full host acceptance.
