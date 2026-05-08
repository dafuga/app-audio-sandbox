export default {
	rules: {
		'max-class-lines': sizeRule('Class', 120, 'ClassDeclaration'),
		'max-method-lines': sizeRule('Method', 35, 'MethodDefinition'),
		'no-manager-name': {
			meta: { type: 'suggestion', messages: { manager: 'Avoid catch-all Manager class names.' } },
			create(context) {
				return {
					ClassDeclaration(node) {
						if (node.id?.name?.endsWith('Manager'))
							context.report({ node: node.id, messageId: 'manager' });
					}
				};
			}
		}
	}
};

function sizeRule(label, max, selector) {
	return {
		meta: {
			type: 'suggestion',
			messages: { tooLarge: label + ' has {{lines}} lines. Limit is {{max}}.' }
		},
		create(context) {
			return {
				[selector](node) {
					const lines = node.loc.end.line - node.loc.start.line + 1;
					if (lines > max) context.report({ node, messageId: 'tooLarge', data: { lines, max } });
				}
			};
		}
	};
}
