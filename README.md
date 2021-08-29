# fast-pytest-github-action
Strives to run unit tests as quickly as possible in GH Action.

---

## Core Idea

This github action will automatically cache your python dependencies based on the contents of the requirements file.
This should speedup your action execution time over time.

It has only been tested with toy examples so far, so feel free to open PRs to support your use case.

By default, this GH action will also search for the keyword 'failed' in the pytest output, and flag as a failed execution.
If you provide tests that have `failed` in it's name, you might get inconsistent behavior.

## Usage

To use this action, python must be available in the job. The easiest way is to call `@actions/setup-python@v2` first.

You must also pass two required arguments:

- pytest_args: the arguments passed to pytest.
- requirements_file: where to find a requirements file with test dependencies.

Even if you have no arguments and no test dependencies, these should be provided.

In this case you can pass something as simple as: `pytest_args: '.'` and provide an empty requirements file .



## Example
Here's a full working example:
```yaml
    sample_job:
      runs-on: ubuntu-latest
      name: Pytest passing tests
      steps:
        - uses: actions/setup-python@v2
          with:
            python-version: '3.8'
        - name: Checkout
          uses: actions/checkout@v2
        - name: Pytest Action Step
          id: pytest
          uses: paolorechia/fast-pytest-github-action@develop
          with:
            pytest_args: 'sample_py/test_success.py'
            requirements_file: 'test_requirements.txt'
```


