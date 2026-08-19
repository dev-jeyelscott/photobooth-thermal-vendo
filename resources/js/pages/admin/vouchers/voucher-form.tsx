import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RouteFormDefinition } from '@/wayfinder';

type Voucher = {
    id: number;
    code: string;
    active: boolean;
    expiresAt: string | null;
    usageLimit: number;
    usageCount: number;
};

export default function VoucherForm({
    form,
    voucher,
}: {
    form: RouteFormDefinition<'post' | 'put'>;
    voucher?: Voucher;
}) {
    return (
        <Form
            {...form}
            options={{ preserveScroll: true }}
            className="max-w-xl space-y-6"
        >
            {({ processing, errors }) => (
                <>
                    <div className="grid gap-2">
                        <Label htmlFor="code">Code</Label>
                        <Input
                            id="code"
                            name="code"
                            required
                            defaultValue={voucher?.code}
                            placeholder="VCH-ABCD-1234"
                        />
                        <InputError message={errors.code} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="expires_at">
                            Expiration date (optional)
                        </Label>
                        <Input
                            id="expires_at"
                            name="expires_at"
                            type="datetime-local"
                            defaultValue={voucher?.expiresAt?.slice(0, 16)}
                        />
                        <InputError message={errors.expires_at} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="usage_limit">Usage limit</Label>
                        <Input
                            id="usage_limit"
                            name="usage_limit"
                            type="number"
                            min={1}
                            required
                            defaultValue={voucher?.usageLimit ?? 1}
                        />
                        <InputError message={errors.usage_limit} />
                    </div>

                    {voucher && (
                        <div className="grid gap-2">
                            <Label htmlFor="usage_count">Usage count</Label>
                            <Input
                                id="usage_count"
                                type="number"
                                value={voucher.usageCount}
                                disabled
                                readOnly
                            />
                            <p className="text-sm text-muted-foreground">
                                Usage count is tracked automatically during
                                redemption and cannot be edited here.
                            </p>
                        </div>
                    )}

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="active"
                            name="active"
                            defaultChecked={voucher?.active ?? true}
                        />
                        <Label htmlFor="active">Active</Label>
                    </div>

                    <Button type="submit" disabled={processing}>
                        {voucher ? 'Save changes' : 'Create voucher'}
                    </Button>
                </>
            )}
        </Form>
    );
}
