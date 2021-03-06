/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {AggregatedResult} from 'types/TestResult';

const chalk = require('chalk');
const ansiEscapes = require('ansi-escapes');
const {pluralize} = require('./reporters/utils');
const {KEYS} = require('./constants');

export default class SnapshotInteractiveMode {
  _pipe: stream$Writable | tty$WriteStream;
  _isActive: boolean;
  _updateTestRunnerConfig: (path: string, shouldUpdateSnapshot: boolean) => *;
  _testFilePaths: Array<string>;
  _countPaths: number;

  constructor(pipe: stream$Writable | tty$WriteStream) {
    this._pipe = pipe;
    this._isActive = false;
  }

  isActive() {
    return this._isActive;
  }

  _drawUIOverlay() {
    this._pipe.write(ansiEscapes.cursorUp(6));
    this._pipe.write(ansiEscapes.eraseDown);

    const numFailed = this._testFilePaths.length;
    const numPass = this._countPaths - this._testFilePaths.length;

    let stats = chalk.bold.red(pluralize('suite', numFailed) + ' failed');
    if (numPass) {
      stats += ', ' + chalk.bold.green(pluralize('suite', numPass) + ' passed');
    }
    const messages = [
      '\n' + chalk.bold('Interactive Snapshot Progress'),
      ' \u203A ' + stats,
      '\n' + chalk.bold('Watch Usage'),

      chalk.dim(' \u203A Press ') +
        'u' +
        chalk.dim(' to update failing snapshots for this test.'),

      this._testFilePaths.length > 1
        ? chalk.dim(' \u203A Press ') +
          's' +
          chalk.dim(' to skip the current test suite.')
        : '',

      chalk.dim(' \u203A Press ') +
        'q' +
        chalk.dim(' to quit Interactive Snapshot Update Mode.'),

      chalk.dim(' \u203A Press ') +
        'Enter' +
        chalk.dim(' to trigger a test run.'),
    ];

    this._pipe.write(messages.filter(Boolean).join('\n') + '\n');
  }

  put(key: string) {
    switch (key) {
      case KEYS.S:
        const testFilePath = this._testFilePaths.shift();
        this._testFilePaths.push(testFilePath);
        this._run(false);
        break;
      case KEYS.U:
        this._run(true);
        break;
      case KEYS.Q:
      case KEYS.ESCAPE:
        this.abort();
        break;
      case KEYS.ENTER:
        this._run(false);
        break;
      default:
        break;
    }
  }

  abort() {
    this._isActive = false;
    this._updateTestRunnerConfig('', false);
  }

  updateWithResults(results: AggregatedResult) {
    const hasSnapshotFailure = !!results.snapshot.failure;
    if (hasSnapshotFailure) {
      this._drawUIOverlay();
      return;
    }

    this._testFilePaths.shift();
    if (this._testFilePaths.length === 0) {
      this.abort();
      return;
    }
    this._run(false);
  }

  _run(shouldUpdateSnapshot: boolean) {
    const testFilePath = this._testFilePaths[0];
    this._updateTestRunnerConfig(testFilePath, shouldUpdateSnapshot);
  }

  run(
    failedSnapshotTestPaths: Array<string>,
    onConfigChange: (path: string, shouldUpdateSnapshot: boolean) => *,
  ) {
    if (!failedSnapshotTestPaths.length) {
      return;
    }

    this._testFilePaths = [].concat(failedSnapshotTestPaths);
    this._countPaths = this._testFilePaths.length;
    this._updateTestRunnerConfig = onConfigChange;
    this._isActive = true;
    this._run(false);
  }
}
