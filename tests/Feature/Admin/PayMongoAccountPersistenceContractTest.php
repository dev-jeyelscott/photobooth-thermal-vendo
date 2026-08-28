<?php

use App\Models\PayMongoAccount;

test('PayMongo account uses the canonical tenant credential table', function () {
    $account = new PayMongoAccount;

    expect($account->getTable())
        ->toBe('paymongo_accounts');
});
