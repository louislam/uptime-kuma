export const buildUrl = (baseUrl, searchParamsRaw) => {
    const urlObject = new URL(baseUrl);
    const searchParams = new URLSearchParams(searchParamsRaw);
    urlObject.search = searchParams?.toString();

    return urlObject.toString();

};

export const filterSearchParams = (searchParams) => {
    return Object.keys(searchParams).reduce((carry, key) => {
        if (searchParams[key] && searchParams[key] !== "") {
            carry[key] = searchParams[key];
        }

        return carry;
    }, {});
};
