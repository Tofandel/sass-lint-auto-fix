import { AbstractSyntaxTree, Nullable, SlRule } from '@src/typings';
import BaseResolver from './base-resolver';

const gonzales = require('gonzales-pe-sl');

enum TokenType {
  NEWLINE = '\n',
  OPEN = '{',
  CLOSE = '}',
  EMPTY = '',
  COMMA = ',',
}

interface Block {
  type: TokenType;
  lineNumber: number;
}

export default class EmptyLineBetweenBlocks extends BaseResolver {
  private _scssEmptyLineRegex: RegExp;

  constructor(ast: AbstractSyntaxTree, parser: SlRule) {
    super(ast, parser);
    this._scssEmptyLineRegex = /}\n( *[\.a-zA-Z0-9=\-:&\[\]]+) {/gm;
  }

  public fix(): AbstractSyntaxTree {
    const { ast } = this;
    // TODO: Implement `fix` for sass
    if (ast.syntax === 'scss') {
      if (this.canInjectNewline()) {
        const content = ast.toString();
        const splitContent = content.split(TokenType.NEWLINE);
        const blocks: Block[] = [];

        // Ordered set of token evaluators. Important that the ordering stayst the same
        const tokenEvaluationSet: ((line: string) => Nullable<TokenType>)[] = [
          line => (line.includes(TokenType.OPEN) ? TokenType.OPEN : null),
          line =>
            line.trimRight().endsWith(TokenType.COMMA) ? TokenType.OPEN : null,
          line => (line.includes(TokenType.CLOSE) ? TokenType.CLOSE : null),
        ];

        splitContent.forEach((line, lineNumber) => {
          tokenEvaluationSet.forEach(tokenEvaluator => {
            const evaluationResult = tokenEvaluator(line);
            if (evaluationResult !== null) {
              blocks.push({
                type: evaluationResult,
                lineNumber: lineNumber + 1,
              });
            }
          });
          // push a newline per iteration of split content
          blocks.push({
            type: TokenType.NEWLINE,
            lineNumber: lineNumber + 1,
          });
        });
        const injectableBlocks = blocks.filter((block, index) => {
          if (block.type === TokenType.CLOSE) {
            if (this.shouldInjectNewline(blocks.slice(index + 1))) {
              return true;
            }
          }
          return false;
        });

        let numInjected = 0;

        injectableBlocks.forEach(({ lineNumber }) =>
          splitContent.splice(lineNumber + numInjected++, 0, TokenType.EMPTY),
        );
        const newTree = gonzales.parse(splitContent.join(TokenType.NEWLINE), {
          syntax: 'scss',
        });

        return newTree;
      }
    }
    return ast;
  }

  private shouldInjectNewline(blocks: Block[]) {
    let c = 0;
    for (const block of blocks) {
      if (block.type === TokenType.NEWLINE) {
        c++;
      } else if (block.type === TokenType.OPEN) {
        return c < 2;
      }
    }
    return false;
  }

  private canInjectNewline(): boolean {
    return (
      this.parser.options.include === true &&
      this.parser.options['allow-single-line-rulesets'] === true
    );
  }

  private sanitize(content: string): string {
    return content.replace(this._scssEmptyLineRegex, '}\n\n$1 {');
  }
}
