// Copyright 2018 The AMPHTML Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable new-cap */
import CodeMirror from 'codemirror';
import { calculateHash } from '@ampproject/toolbox-script-csp'

export function createCspHashCalculator(editor) {
  return new CspHashCalculator(editor);
}

class CspHashCalculator {
  constructor(editor) {
    this.editor = editor;
  }

  update(source) {
    const scripts = this._getScripts();
    // If there aren't any scripts theres no need to inject the amp-script-src
    // meta element. Hence stop
    if (!scripts.length) {
      return;
    }

    const hashes = this._generateHashes(scripts).join('');
    const meta = `<meta name="amp-script-src" content="${hashes}"/>`;

    // Remove all potentially existing CSP meta elements and inject the
    // new meta element at the end of the head element
    let updatedSource = source.replace(/<meta[^>]*name="amp-script-src"[^>]*>/gms, '').replace('</head>', meta + '</head>');

    console.log(updatedSource);
  }


  _generateHashes(scripts) {
    return scripts.map((script) => {
      console.log(script);
      return calculateHash(script);
    });
  }

  _getScripts() {
    let state = {
      isScript: false,
      hasAmpScriptTarget: false,
    };

    const scripts = [];

    const lineCount = this.editor.lineCount();
    let i = 0;

    while (i < lineCount) {
      const tokens = this.editor.getLineTokens(i);

      let j = 0;
      while (j < tokens.length) {
        const token = tokens[j];

        if (!state.isScript && token.type == 'tag' && token.string == 'script') {
          state.isScript = true;
        }

        // If currently inspecting a script element and not yet capturing
        // wait for a target="amp-script" attribute
        if (state.isScript && token.type == 'attribute' && token.string == 'target') {
          // ... the next token will be =, the one after that will be the
          // value of target enclosed by quotes
          j = j + 2;
          const val = tokens[j] ? tokens[j].string.slice(1, -1) : '';
          if (val == 'amp-script') {
            // Start capturing as as soon as the script is target="amp-script"
            state.hasAmpScriptTarget = true;
          }
        }

        // If in script and target is "amp-script" wait to get inside the
        // scripts context
        if (state.isScript && state.hasAmpScriptTarget) {
          // Stop capturing as soon as the scripts closing tag is hit and
          // store the scripts content to calculate the CSP
          if (token.string === '</') {
            scripts.push(state.content.slice(1).trim());
            state = {};
          }

          // Capture everything that is inside the scripts HTML context.
          // This includes the closing bracket of the opening tag
          const htmlState = token.state.htmlState;
          if (htmlState.context.tagName == 'script') {
            state.content = (state.content || '') + token.string;
          }
        }

        j++;
      }

      i++;
    }

    return scripts;
  }
}
