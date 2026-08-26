type PasswordRulesHintProps = {
    id: string;
    passwordRules: string;
};

/**
 * Renders a concise human-readable hint derived only from the password-rules
 * contract supplied by Laravel Fortify.
 */
export default function PasswordRulesHint({
    id,
    passwordRules,
}: PasswordRulesHintProps) {
    return (
        <p id={id} className="text-xs leading-5 text-muted-foreground">
            {describePasswordRules(passwordRules)}
        </p>
    );
}

/**
 * Converts Laravel's browser password-rules string into descriptive copy while
 * falling back safely when a rule cannot be represented client-side.
 */
function describePasswordRules(passwordRules: string): string {
    const requirements: string[] = [];

    const minimumLength = passwordRules.match(/minlength:\s*(\d+)/i)?.[1];

    if (minimumLength) {
        requirements.push(`at least ${minimumLength} characters`);
    }

    const requiresUppercase = /required:\s*upper/i.test(passwordRules);
    const requiresLowercase = /required:\s*lower/i.test(passwordRules);

    if (requiresUppercase && requiresLowercase) {
        requirements.push('upper and lowercase letters');
    } else if (requiresUppercase) {
        requirements.push('an uppercase letter');
    } else if (requiresLowercase) {
        requirements.push('a lowercase letter');
    }

    if (
        /required:\s*digit/i.test(passwordRules) ||
        /required:\s*number/i.test(passwordRules)
    ) {
        requirements.push('a number');
    }

    if (
        /required:\s*special/i.test(passwordRules) ||
        /required:\s*symbol/i.test(passwordRules)
    ) {
        requirements.push('a symbol');
    }

    if (requirements.length === 0) {
        return 'Use a secure password that meets the required password rules.';
    }

    if (requirements.length === 1) {
        return `Password must include ${requirements[0]}.`;
    }

    if (requirements.length === 2) {
        return `Password must include ${requirements[0]} and ${requirements[1]}.`;
    }

    const lastRequirement = requirements.at(-1);
    const precedingRequirements = requirements.slice(0, -1);

    return `Password must include ${precedingRequirements.join(', ')}, and ${lastRequirement}.`;
}
