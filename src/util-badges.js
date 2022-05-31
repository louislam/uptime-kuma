export const buildUrl = (baseUrl, searchParamsRaw) => {
    const urlObject = new URL(baseUrl);
    const searchParams = new URLSearchParams(searchParamsRaw);
    urlObject.search = searchParams?.toString();

    return urlObject.toString();

};
