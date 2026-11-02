using System;
using System.Net;
using System.Threading;

/**
 * Compile: C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe index.cs
 * Run: index.exe
 */
class Index
{
    const string PushURL  = "https://example.com/api/push/key?status=up&msg=OK&ping=";
    const int Interval = 60;
    const string Method = "GET";

    static void Main(string[] args)
    {
        while (true)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(PushURL);
            request.Method = Method;
            request.GetResponse().Close();
            Console.WriteLine("Pushed!");
            Thread.Sleep(Interval * 1000);
        }
    }
}
